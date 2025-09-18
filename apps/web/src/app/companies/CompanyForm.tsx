"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Label } from "ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "ui";
import { createCompanySchema, updateCompanySchema } from "shared/src/schema/company";
import { Company } from "database";

export function CompanyForm({ company, onSubmit }: { company?: Company, onSubmit: (values: any) => void }) {
  const formSchema = company ? updateCompanySchema : createCompanySchema;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: company ? { id: company.id, name: company.name } : {},
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{company ? "Edit Company" : "Add Company"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? "Edit Company" : "Add Company"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <Label>Name</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && <p>{form.formState.errors.name.message}</p>}
          </div>
          <Button type="submit">Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
