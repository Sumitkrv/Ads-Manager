import { z } from "zod";
export declare const LoginInputSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    password: z.ZodString;
}, z.core.$strip>;
export declare const SignupInputSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    termsAccepted: z.ZodBoolean;
}, z.core.$strip>;
export declare const ForgotPasswordInputSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export declare const ResetPasswordInputSchema: z.ZodObject<{
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, z.core.$strip>;
export declare const ProfileUpdateInputSchema: z.ZodObject<{
    fullName: z.ZodString;
}, z.core.$strip>;
export declare const ProfileRowSchema: z.ZodObject<{
    id: z.ZodString;
    user_id: z.ZodString;
    full_name: z.ZodNullable<z.ZodString>;
    avatar_url: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
export declare const MeResponseSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        emailConfirmedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type SignupInput = z.infer<typeof SignupInputSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;
export type ProfileRow = z.infer<typeof ProfileRowSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
//# sourceMappingURL=auth.d.ts.map