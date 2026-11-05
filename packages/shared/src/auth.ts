import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.")
  .max(320, "Email address is too long.")
  .transform((value) => value.toLowerCase());

const newPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

export const LoginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const SignupInputSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Enter your full name.")
      .max(120, "Name must be 120 characters or fewer."),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine((accepted) => accepted, {
      message: "Accept the terms to create an account.",
    }),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const ForgotPasswordInputSchema = z.object({ email: emailSchema });

export const ResetPasswordInputSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const ProfileUpdateInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(120, "Name must be 120 characters or fewer."),
});

export const ProfileRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  avatar_url: z.string().max(2048).refine((value) => {
    if (value.startsWith("https://") || value.startsWith("http://")) return z.string().url().safeParse(value).success;
    return /^tandem-user-avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/i.test(value);
  }).nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const MeResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    emailConfirmedAt: z.string().nullable(),
    createdAt: z.string().min(1),
  }),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type SignupInput = z.infer<typeof SignupInputSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;
export type ProfileRow = z.infer<typeof ProfileRowSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
