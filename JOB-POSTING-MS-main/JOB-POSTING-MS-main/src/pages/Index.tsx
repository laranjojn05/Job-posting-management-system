
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-4xl font-bold mb-6">Welcome to JPMS</h1>
      <p className="text-xl text-gray-600 mb-8 text-center">
        A simple and powerful job management system
      </p>
      <Button onClick={() => navigate("/auth")} size="lg">
        Get Started
      </Button>
    </div>
  );
};

export default Index;
