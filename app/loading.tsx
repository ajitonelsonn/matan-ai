import { MatanLoader } from "@/components/matan/MatanLoader";

export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <MatanLoader size="md" label="Loading page" />
    </div>
  );
}
