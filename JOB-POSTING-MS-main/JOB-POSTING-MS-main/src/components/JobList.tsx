
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import JobApplicationDialog from "./JobApplicationDialog";
import { Button } from "@/components/ui/button";

interface JobPost {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  description: string;
  requirements: string;
  created_at: string;
}

const JobList = () => {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [applyOpenId, setApplyOpenId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from("job_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setJobs(data);
      }
    };

    fetchJobs();

    const channel = supabase
      .channel("job_changes")
      .on("postgres_changes", 
        { event: "*", schema: "public", table: "job_posts" },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    // Get session for showing apply button only to logged in users
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Recent Job Posts</h2>
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <CardTitle>{job.title}</CardTitle>
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
  );
};

export default JobList;
