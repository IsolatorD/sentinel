import { Button } from "@/components/atoms/Button/Button";
import { GoogleMark } from "@/components/molecules/GoogleButton/GoogleMark/GoogleMark";

export function GoogleButton({
	label,
	loading,
	onClick,
}: {
	label: string;
	loading?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			variant="secondary"
			className="w-full"
			loading={loading}
			onClick={onClick}
		>
			<GoogleMark />
			{label}
		</Button>
	);
}
