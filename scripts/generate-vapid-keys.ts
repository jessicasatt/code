/**
 * Generates a Web Push VAPID keypair. Run once; put the public key in
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY and the private key in VAPID_PRIVATE_KEY via
 * your hosting platform's environment variable manager (never in chat or
 * committed to git).
 */
import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();
console.log("VAPID keys generated. Store these as environment variables — do not commit them.\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
