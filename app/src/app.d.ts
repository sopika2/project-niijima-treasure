declare global {
	namespace App {
		interface Locals {
			/** Who is signed in with Discord (null when ACCESS_MODE=off). */
			user: { id: string; name: string } | null;
		}
	}
}

export {};
