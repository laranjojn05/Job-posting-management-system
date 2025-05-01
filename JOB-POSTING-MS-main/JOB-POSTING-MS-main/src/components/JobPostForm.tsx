import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";

const JobPostForm = ({ onPostSuccess }: { onPostSuccess?: () => void }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [postToFacebook, setPostToFacebook] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    location: "",
    salary_range: "",
    description: "",
    requirements: ""
  });

  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.title.trim()) errors.title = "Job title is required";
    if (!formData.company.trim()) errors.company = "Company name is required";
    if (!formData.location.trim()) errors.location = "Location is required";
    if (!formData.description.trim()) errors.description = "Description is required";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      title: "",
      company: "",
      location: "",
      salary_range: "",
      description: "",
      requirements: ""
    });
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Form Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        toast({
          title: "Session Expired",
          description: "Please log in to post a job",
          variant: "destructive",
        });
        return;
      }

      let facebookPostId = null;
      let facebookError = null;

      // Only try to post to Facebook if the user opted in
      if (postToFacebook) {
        try {
          const { data: fbData, error: fbError } = await supabase.functions.invoke('post-to-facebook', {
            body: formData
          });

          if (fbError) {
            console.error("Facebook posting error:", fbError);
            facebookError = fbError;
          } else if (fbData?.facebook_post_id) {
            facebookPostId = fbData.facebook_post_id;
          }
        } catch (fbPostError) {
          console.error("Facebook function error:", fbPostError);
          facebookError = fbPostError;
        }
      }

      // Save to database regardless of Facebook status
      const { error: dbError } = await supabase
        .from("job_posts")
        .insert({
          ...formData,
          user_id: session.user.id,
          facebook_post_id: facebookPostId
        });

      if (dbError) {
        throw dbError;
      }

      // Show appropriate success message
      if (facebookError && postToFacebook) {
        toast({
          title: "Partial Success",
          description: "Job post created but couldn't share on Facebook. It will be available in the job board.",
        });
      } else {
        toast({
          title: "Success",
          description: facebookPostId 
            ? "Job post created successfully and shared on Facebook!" 
            : "Job post created successfully!",
        });
      }

      // Reset form after successful submission
      resetForm();

      // Inform parent to reload job posts
      if (onPostSuccess) onPostSuccess();
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user types
    if (formErrors[name]) {
      setFormErrors(prev => {
        const updated = {...prev};
        delete updated[name];
        return updated;
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Job Post</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              name="title"
              placeholder="Job Title"
              value={formData.title}
              onChange={handleChange}
              className={formErrors.title ? "border-red-500" : ""}
              required
            />
            {formErrors.title && <p className="text-sm text-red-500 mt-1">{formErrors.title}</p>}
          </div>
          
          <div>
            <Input
              name="company"
              placeholder="Company Name"
              value={formData.company}
              onChange={handleChange}
              className={formErrors.company ? "border-red-500" : ""}
              required
            />
            {formErrors.company && <p className="text-sm text-red-500 mt-1">{formErrors.company}</p>}
          </div>
          
          <div>
            <Input
              name="location"
              placeholder="Location"
              value={formData.location}
              onChange={handleChange}
              className={formErrors.location ? "border-red-500" : ""}
              required
            />
            {formErrors.location && <p className="text-sm text-red-500 mt-1">{formErrors.location}</p>}
          </div>
          
          <Input
            name="salary_range"
            placeholder="Salary Range (optional)"
            value={formData.salary_range}
            onChange={handleChange}
          />
          
          <div>
            <Textarea
              name="description"
              placeholder="Job Description"
              value={formData.description}
              onChange={handleChange}
              className={formErrors.description ? "border-red-500" : ""}
              required
            />
            {formErrors.description && <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>}
          </div>
          
          <Textarea
            name="requirements"
            placeholder="Requirements (optional)"
            value={formData.requirements}
            onChange={handleChange}
          />
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="postToFacebook" 
              checked={postToFacebook}
              onCheckedChange={(checked) => setPostToFacebook(checked as boolean)}
            />
            <label
              htmlFor="postToFacebook"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Post to Facebook
            </label>
          </div>
          
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Job Post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default JobPostForm;
