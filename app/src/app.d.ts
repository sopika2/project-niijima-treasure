declare global {
	namespace App {
		interface Locals {
			/** Who is signed in through Cloudflare Access (null when ACCESS_MODE=off). */
			user: { email: string } | null;
		}
	}
}

export {};
