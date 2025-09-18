"use client";

import { trpc } from "@/trpc/client";
import { UserForm } from "./UserForm";
import { z } from "zod";
import { createUserSchema, updateUserSchema } from "shared/src/schema/user";

export default function UsersPage() {
  const { data: users, isLoading, refetch } = trpc.user.list.useQuery();

  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateUser = trpc.user.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleCreateUser = (values: z.infer<typeof createUserSchema>) => {
    createUser.mutate(values);
  };

  const handleUpdateUser = (values: z.infer<typeof updateUserSchema>) => {
    updateUser.mutate(values);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="mt-4">
        <UserForm onSubmit={handleCreateUser} />
      </div>
      <div className="mt-4">
        {users?.map((user) => (
          <div key={user.id} className="border p-4 my-2 flex justify-between items-center">
            <p>{user.email}</p>
            <UserForm user={user} onSubmit={handleUpdateUser} />
          </div>
        ))}
      </div>
    </div>
  );
}
