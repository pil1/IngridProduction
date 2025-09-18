"use client";

import { trpc } from "@/trpc/client";

export default function Home() {
  const { data, isLoading } = trpc.user.hello.useQuery();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>{data}</p>
    </div>
  );
}
