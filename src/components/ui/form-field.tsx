import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface BaseFormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  description?: string;
}

interface TextFormFieldProps extends BaseFormFieldProps {
  type: "text" | "email" | "password" | "number" | "url";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface TextareaFormFieldProps extends BaseFormFieldProps {
  type: "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

interface SelectFormFieldProps extends BaseFormFieldProps {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

interface CheckboxFormFieldProps extends BaseFormFieldProps {
  type: "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
}

type FormFieldProps = TextFormFieldProps | TextareaFormFieldProps | SelectFormFieldProps | CheckboxFormFieldProps;

export function FormField(props: FormFieldProps) {
  const { label, error, required, className, description } = props;

  const renderField = () => {
    switch (props.type) {
      case "text":
      case "email":
      case "password":
      case "number":
      case "url":
        return (
          <Input
            type={props.type}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            className={error ? "border-red-500" : ""}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            rows={props.rows}
            className={error ? "border-red-500" : ""}
          />
        );

      case "select":
        return (
          <Select value={props.value} onValueChange={props.onChange}>
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder={props.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {props.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={props.checked}
              onCheckedChange={props.onChange}
              className={error ? "border-red-500" : ""}
            />
            <Label className="text-sm font-normal">{label}</Label>
          </div>
        );
    }
  };

  if (props.type === "checkbox") {
    return (
      <div className={cn("space-y-2", className)}>
        {renderField()}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {renderField()}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}