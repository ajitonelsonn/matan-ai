import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg">
      <EmptyState icon={<SearchX />} title="Page not found" description="Matan couldn't find that page. It may have moved, or the link is out of date." action={<Button href="/">Back to Home</Button>} />
    </div>
  );
}
