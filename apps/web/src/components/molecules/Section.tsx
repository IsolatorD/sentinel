import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/atoms/Card";

export function Section({
	title,
	action,
	children,
	flush,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	flush?: boolean;
}) {
	return (
		<Card>
			<CardHeader className="flex items-center justify-between gap-3">
				<CardTitle>{title}</CardTitle>
				{action}
			</CardHeader>
			{flush ? children : <CardBody>{children}</CardBody>}
		</Card>
	);
}
