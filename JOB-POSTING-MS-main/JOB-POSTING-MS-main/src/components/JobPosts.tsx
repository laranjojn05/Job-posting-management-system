
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import JobPostForm from "./JobPostForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import JobApplicationDialog from "./JobApplicationDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Trash2 } from "lucide-react";

interface JobPost {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  description: string;
  requirements: string;
  created_at: string;
  user_id: string;
}

const JobPosts = () => {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [applyOpenId, setApplyOpenId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("job_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setJobs(data);
    }
  };

  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel("job_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_posts" },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  const handleDelete = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job post?")) return;
    setLoadingDeleteId(jobId);
    try {
      const { error } = await supabase
        .from("job_posts")
        .delete()
        .eq("id", jobId)
        .eq("user_id", session.user.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Job post deleted successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete job post.",
        variant: "destructive",
      });
    } finally {
      setLoadingDeleteId(null);
      fetchJobs();
    }
  };

  return (
    <div>
      {/* Job creation form */}
      <JobPostForm onPostSuccess={fetchJobs} />

      {/* Recent job posts */}
      <div className="space-y-4 mt-10">
        <h2 className="text-xl font-semibold">Recent Job Posts</h2>
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{job.title}</CardTitle>
              {session?.user?.id === job.user_id && (
                <Button
                  variant="destructive"
                  size="icon"
                  disabled={loadingDeleteId === job.id}
                  onClick={() => handleDelete(job.id)}
                  aria-label="Delete job post"
                >
                  {loadingDeleteId === job.id ? '...' : <Trash2 />}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Company:</strong> {job.company}</p>
                <p><strong>Location:</strong> {job.location}</p>
                {job.salary_range && (
                  <p><strong>Salary Range:</strong> {job.salary_range}</p>
                )}
                <p className="mt-2">{job.description}</p>
                {job.requirements && (
                  <div className="mt-2">
                    <strong>Requirements:</strong>
                    <p>{job.requirements}</p>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Posted on: {new Date(job.created_at).toLocaleDateString()}
                </p>
                {session &&
                  <div className="mt-3">
                    <Button onClick={() => setApplyOpenId(job.id)}>
                      Apply
                    </Button>
                    <JobApplicationDialog
                      jobId={job.id}
                      postOwnerId={job.user_id}
                      open={applyOpenId === job.id}
                      onOpenChange={(open) => setApplyOpenId(open ? job.id : null)}
                    />
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default JobPosts;
