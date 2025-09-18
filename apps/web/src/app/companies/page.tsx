"use client";

import { trpc } from "@/trpc/client";
import { CompanyForm } from "./CompanyForm";
import { z } from "zod";
import { createCompanySchema, updateCompanySchema } from "shared/src/schema/company";

export default function CompaniesPage() {
  const { data: companies, isLoading, refetch } = trpc.company.list.useQuery();

  const createCompany = trpc.company.create.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateCompany = trpc.company.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleCreateCompany = (values: z.infer<typeof createCompanySchema>) => {
    createCompany.mutate(values);
  };

  const handleUpdateCompany = (values: z.infer<typeof updateCompanySchema>) => {
    updateCompany.mutate(values);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Companies</h1>
      <div className="mt-4">
        <CompanyForm onSubmit={handleCreateCompany} />
      </div>
      <div className="mt-4">
        {companies?.map((company) => (
          <div key={company.id} className="border p-4 my-2 flex justify-between items-center">
            <p>{company.name}</p>
            <CompanyForm company={company} onSubmit={handleUpdateCompany} />
          </div>
        ))}
      </div>
    </div>
  );
}
