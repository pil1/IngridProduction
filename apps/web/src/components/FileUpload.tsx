"use client";

import React, { useState } from "react";
import { Button, Input } from "ui";
import { trpc } from "@/trpc/client";

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const processReceipt = trpc.expenses.processReceipt.useMutation();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`File uploaded successfully: ${data.filePath}`);
        const result = await processReceipt.mutateAsync({ filePath: data.filePath });
        setMessage(result.message || `Extracted text: ${result.extractedText}`);
      } else {
        setMessage(`File upload failed: ${data.message}`);
      }
    } catch (error) {
      console.error(error);
      setMessage("An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Input type="file" onChange={handleFileChange} />
      <Button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload File"}
      </Button>
      {message && <p>{message}</p>}
    </div>
  );
}
