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
      <Script id="facebook-pixel-businessos" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '3962493080666052');
        fbq('track', 'PageView');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src="https://www.facebook.com/tr?id=3962493080666052&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
      {children}
    </>
  );
}
