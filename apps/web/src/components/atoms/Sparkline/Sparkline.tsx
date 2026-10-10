import {
	GAP,
	HEIGHT,
	WIDTH,
} from "@/components/atoms/Sparkline/Sparkline.constants";
import { barHeights } from "@/utils/trend/trend";

/** Barras minúsculas sin ejes, para ver la forma de la actividad de un vistazo. */
export function Sparkline({
	values,
	label,
}: {
	values: number[];
	/** Descripción para lectores de pantalla. */
	label: string;
}) {
	const heights = barHeights(values);
	const barWidth = values.length ? WIDTH / values.length - GAP : 0;
	return (
		<svg
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			role="img"
			aria-label={label}
			className="h-6 w-24"
			data-testid="sparkline"
		>
			<line
				x1={0}
				x2={WIDTH}
				y1={HEIGHT - 0.5}
				y2={HEIGHT - 0.5}
				className="stroke-border"
			/>
			{heights.map((h, i) => (
				<rect
					// biome-ignore lint/suspicious/noArrayIndexKey: la posición es la identidad de la barra
					key={i}
					x={i * (barWidth + GAP)}
					y={HEIGHT - Math.max(h * (HEIGHT - 1), h > 0 ? 2 : 0)}
					width={barWidth}
					height={Math.max(h * (HEIGHT - 1), h > 0 ? 2 : 0)}
					className="fill-primary"
				/>
			))}
		</svg>
	);
}
