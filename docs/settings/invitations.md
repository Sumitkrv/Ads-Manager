# Invitations

An owner/admin creates an invitation with a permitted role. Express generates a cryptographically random token, stores only its SHA-256 hash through the existing invitation RPC, and returns a link whose token is in the URL fragment. The invitation expires after seven days. The recipient must sign in with the verified invited email; the role is server-selected and cannot be changed by the recipient.

The UI states **“Invitation link created — not emailed.”** No email/message provider is called. A replacement link revokes the earlier generic invite; agency relationship invitations remain in the agency workflow. Owners/admins can revoke pending invitations. Acceptance locks and consumes a pending invitation, creates only its stated workspace membership and agency grant where applicable, and rejects expired, revoked, mismatched and replayed tokens. A repeated acceptance by the same already-added identity returns an idempotent accepted result.

Seat usage comes from the existing Billing summary. Pending, unexpired invites reserve seats at creation under a workspace lock. No checkout or plan upgrade is performed by this flow.
