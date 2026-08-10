import { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "BusinessOS© | Your Business, Automated",
  description:
    "BusinessOS is how you go from 'our operations are in people's heads' to 'our business runs itself.' Custom internal software that fits your business like a tailored suit.",
  openGraph: {
    title: "BusinessOS© | Your Business, Automated",
    description:
      "BusinessOS is how you go from 'our operations are in people's heads' to 'our business runs itself.' Custom internal software that fits your business like a tailored suit.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BusinessOS© | Your Business, Automated",
    description:
      "BusinessOS is how you go from 'our operations are in people's heads' to 'our business runs itself.' Custom internal software that fits your business like a tailored suit.",
  },
};

export default function BusinessOSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script id="clarity-script-businessos" type="text/javascript">
        {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "k1v4rs1i24");`}
      </Script>
      {children}
    </>
  );
}
