export interface PaginationProps {
	offset: number;
	limit: number;
	total: number;
	onChange: (offset: number) => void;
}
