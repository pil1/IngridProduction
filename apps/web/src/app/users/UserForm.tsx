"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Label } from "ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "ui";
import { createUserSchema, updateUserSchema } from "shared/src/schema/user";
import { User } from "database";

export function UserForm({ user, onSubmit }: { user?: User, onSubmit: (values: any) => void }) {
  const formSchema = user ? updateUserSchema : createUserSchema;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: user ? { id: user.id, email: user.email, password: "" } : {},
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{user ? "Edit User" : "Add User"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Add User"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <Label>Email</Label>
            <Input {...form.register("email")} />
            {form.formState.errors.email && <p>{form.formState.errors.email.message}</p>}
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" {...form.register("password")} />
            {form.formState.errors.password && <p>{form.formState.errors.password.message}</p>}
          </div>
          <Button type="submit">Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
