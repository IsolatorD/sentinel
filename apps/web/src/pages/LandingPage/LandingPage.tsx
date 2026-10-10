import { ArchitectureSection } from "@/components/organisms/ArchitectureSection/ArchitectureSection";
import { FeatureGrid } from "@/components/organisms/FeatureGrid/FeatureGrid";
import { HowItWorks } from "@/components/organisms/HowItWorks/HowItWorks";
import { LandingCta } from "@/components/organisms/LandingCta/LandingCta";
import { LandingHero } from "@/components/organisms/LandingHero/LandingHero";
import { SdkShowcase } from "@/components/organisms/SdkShowcase/SdkShowcase";
import { TraceExplainer } from "@/components/organisms/TraceExplainer/TraceExplainer";
import { PublicTemplate } from "@/components/templates/PublicTemplate/PublicTemplate";

/** La página pública de Sentinel: qué es, qué hace, cómo se instala y cómo está construido. */
export function LandingPage() {
	return (
		<PublicTemplate active="home">
			<LandingHero />
			<FeatureGrid />
			<HowItWorks />
			<SdkShowcase />
			<TraceExplainer />
			<ArchitectureSection />
			<LandingCta />
		</PublicTemplate>
	);
}
