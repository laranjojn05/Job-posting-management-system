
import { useRef, useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogHeader, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface JobApplicationDialogProps {
  jobId: string;
  postOwnerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JobApplicationDialog = ({ jobId, open, onOpenChange, postOwnerId }: JobApplicationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setResumeFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    let resume_url: string | null = null;

    try {
      // Get the current session/user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ title: "Not logged in", description: "Please log in to apply.", variant: "destructive" });
        setLoading(false);
        onOpenChange(false);
        return;
      }

      // Upload resume if selected
      if (resumeFile) {
        const fileExt = resumeFile.name.split('.').pop();
        const filePath = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(filePath, resumeFile);

        if (uploadError) {
          throw new Error("Resume upload failed. " + uploadError.message);
        }

        // Get public URL (bucket is not public: will need to expose via API if you want real public links)
        resume_url = filePath;
      }

      // Insert application into job_applications
      const { error: insertError } = await supabase
        .from("job_applications")
        .insert({
          job_post_id: jobId,
          user_id: session.user.id,
          message,
          resume_url,
        });

      if (insertError) throw insertError;

      // Call edge function to notify owner and send resume
      if (resume_url) {
        await supabase.functions.invoke('notify-job-owner', {
          body: {
            post_owner_id: postOwnerId,
            applicant_id: session.user.id,
            job_post_id: jobId,
            resume_url,
            message
          }
        });
      }

      toast({ title: "Application Submitted", description: "Your application has been sent!" });
      setMessage("");
      setResumeFile(null);
      fileInputRef.current && (fileInputRef.current.value = "");
      onOpenChange(false);

    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to apply.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to Job</DialogTitle>
          <DialogDescription>Send a message and optionally attach your resume.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Your message to the employer"
            required
          />
          <Input
            type="file"
            accept=".pdf,.doc,.docx"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={loading}
          />
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicationDialog;
