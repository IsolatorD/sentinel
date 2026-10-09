export interface TabBarTab {
	id: string;
	label: string;
}

export interface TabBarProps {
	tabs: TabBarTab[];
	active: string;
	onChange: (id: string) => void;
	/** Nombre accesible del grupo de pestañas. */
	label: string;
}
