import { ProfileRowSchema, type ProfileRow } from "@ai-ads/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseClient } from "../auth/supabase";

const AVATAR_BUCKET = "tandem-user-avatars";
const AVATAR_PREFIX = `${AVATAR_BUCKET}/`;
const avatarMimeExtensions = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  if (!supabaseClient) throw new Error("Profile storage is not available.");
  const extension = avatarMimeExtensions.get(file.type);
  if (!extension) throw new Error("Choose a PNG, JPEG or WebP image.");
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) throw new Error("Choose an image smaller than 2 MB.");
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseClient.storage.from(AVATAR_BUCKET).upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (error) throw new Error("The profile image could not be uploaded.");
  return `${AVATAR_PREFIX}${path}`;
}

export async function getProfileAvatarUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!supabaseClient || !value.startsWith(AVATAR_PREFIX)) return null;
  const { data, error } = await supabaseClient.storage.from(AVATAR_BUCKET).createSignedUrl(value.slice(AVATAR_PREFIX.length), 3600);
  if (error || !data?.signedUrl) throw new Error("The profile image preview is unavailable.");
  return data.signedUrl;
}

export async function removeProfileAvatar(userId: string, value: string | null): Promise<void> {
  if (!supabaseClient || !value?.startsWith(AVATAR_PREFIX)) return;
  const path = value.slice(AVATAR_PREFIX.length);
  if (!path.startsWith(`${userId}/`)) throw new Error("Only the signed-in account's profile image can be removed.");
  const { error } = await supabaseClient.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw new Error("The previous profile image could not be removed.");
}

type ProfileState =
  | { status: "loading"; profile: null; message: null }
  | { status: "ready"; profile: ProfileRow; message: null }
  | { status: "missing"; profile: null; message: string }
  | { status: "error"; profile: null; message: string };

export function useProfile(userId: string | undefined) {
  const [state, setState] = useState<ProfileState>({
    status: "loading",
    profile: null,
    message: null,
  });
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!supabaseClient || !userId) {
      if (requestId.current === currentRequest) {
        setState({ status: "error", profile: null, message: "Profile service is not available." });
      }
      return;
    }

    setState({ status: "loading", profile: null, message: null });
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id,user_id,full_name,avatar_url,created_at,updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (requestId.current !== currentRequest) return;
      if (error) {
        setState({ status: "error", profile: null, message: "Your profile could not be loaded." });
        return;
      }
      if (data === null) {
        setState({
          status: "missing",
          profile: null,
          message: "A profile record was not found for this account.",
        });
        return;
      }

      const parsed = ProfileRowSchema.safeParse(data);
      if (!parsed.success) {
        setState({ status: "error", profile: null, message: "The profile response was invalid." });
        return;
      }
      setState({ status: "ready", profile: parsed.data, message: null });
    } catch {
      if (requestId.current === currentRequest) {
        setState({ status: "error", profile: null, message: "Your profile could not be loaded." });
      }
    }
  }, [userId]);

  useEffect(() => {
    void reload();
    return () => {
      requestId.current += 1;
    };
  }, [reload]);

  const updateFullName = useCallback(
    async (fullName: string) => {
      if (!supabaseClient || !userId) throw new Error("Profile service is not available.");
      setSaving(true);
      try {
        const { data, error } = await supabaseClient
          .from("profiles")
          .update({ full_name: fullName })
          .eq("user_id", userId)
          .select("id,user_id,full_name,avatar_url,created_at,updated_at")
          .maybeSingle();
        if (error || data === null) throw new Error("Your profile could not be saved.");
        const parsed = ProfileRowSchema.safeParse(data);
        if (!parsed.success) throw new Error("The saved profile response was invalid.");
        setState({ status: "ready", profile: parsed.data, message: null });
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  const updateAvatarPath = useCallback(async (avatarPath: string) => {
    if (!supabaseClient || !userId) throw new Error("Profile service is not available.");
    setSaving(true);
    try {
      const { data, error } = await supabaseClient.from("profiles").update({ avatar_url: avatarPath }).eq("user_id", userId).select("id,user_id,full_name,avatar_url,created_at,updated_at").maybeSingle();
      if (error || data === null) throw new Error("Your profile image could not be saved.");
      const parsed = ProfileRowSchema.safeParse(data);
      if (!parsed.success) throw new Error("The saved profile response was invalid.");
      setState({ status: "ready", profile: parsed.data, message: null });
    } finally { setSaving(false); }
  }, [userId]);

  return { ...state, saving, reload, updateFullName, updateAvatarPath };
}
