import type { ReactNode } from "react";
import { Card } from "@/components/atoms/Card/Card";
import { CardBody } from "@/components/atoms/CardBody/CardBody";
import { CardHeader } from "@/components/atoms/CardHeader/CardHeader";
import { CardTitle } from "@/components/atoms/CardTitle/CardTitle";

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
