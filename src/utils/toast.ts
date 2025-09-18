import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const showWarning = (message: string, description?: string) => {
  toast(message, {
    description: description,
    style: {
      backgroundColor: 'hsl(48 96% 89%)', // A light yellow/orange background
      color: 'hsl(24 9.8% 10%)', // Dark text
      borderColor: 'hsl(48 96% 89%)',
    },
    duration: 5000,
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};