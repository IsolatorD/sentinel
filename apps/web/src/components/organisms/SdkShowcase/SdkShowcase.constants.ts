import type { SdkEntry } from "@/components/organisms/SdkShowcase/SdkShowcaseInterface";
import {
	nodeSnippet,
	npmSnippet,
	pythonSnippet,
	reactNativeSnippet,
	reactSnippet,
} from "@/utils/installSnippets/installSnippets";
import { SAMPLE_DSN } from "@/utils/publicLinks/publicLinks.constants";

const dsn = SAMPLE_DSN;

export const SDKS: SdkEntry[] = [
	{
		id: "javascript",
		label: "JavaScript",
		language: "JavaScript / TypeScript",
		snippet: npmSnippet({ dsn }),
	},
	{
		id: "react",
		label: "React",
		language: "React 18+",
		snippet: reactSnippet({ dsn }),
	},
	{
		id: "node",
		label: "Node.js",
		language: "Node.js 20+",
		snippet: nodeSnippet({ dsn }),
	},
	{
		id: "python",
		label: "Python",
		language: "Python 3.9+",
		snippet: pythonSnippet({ dsn }),
	},
	{
		id: "react-native",
		label: "React Native",
		language: "React Native 0.72+",
		snippet: reactNativeSnippet({ dsn }),
	},
];

/** Los tres puntos que se destacan de cada SDK (`landing.sdks.<id>.points.<punto>`). */
export const POINTS = ["one", "two", "three"] as const;
