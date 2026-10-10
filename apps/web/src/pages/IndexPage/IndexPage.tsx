import { Spinner } from "@/components/atoms/Spinner/Spinner";
import { useSession } from "@/hooks/useSession/useSession";
import { HomePage } from "@/pages/HomePage/HomePage";
import { LandingPage } from "@/pages/LandingPage/LandingPage";

/** `/`: quien ya tiene sesión entra directo a su organización; el resto ve la landing. */
export function IndexPage() {
	const session = useSession();
	if (session.isPending)
		return (
			<div className="flex min-h-full items-center justify-center">
				<Spinner className="size-6" />
			</div>
		);
	return session.data ? <HomePage /> : <LandingPage />;
}
