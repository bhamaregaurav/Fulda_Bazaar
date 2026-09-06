export const getFormattedDate = (date: Date) => {
	const options: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit'
	};
	return new Intl.DateTimeFormat('en-US', options).format(date);
};


export function formatMessageDateLabel(dateStr: string): string {
	const msgDate = new Date(dateStr);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	const isSameDay = (d1: Date, d2: Date) =>
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate();

	if (isSameDay(msgDate, today)) return 'Today';
	if (isSameDay(msgDate, yesterday)) return 'Yesterday';

	return msgDate.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}
