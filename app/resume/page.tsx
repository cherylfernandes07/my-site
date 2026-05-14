import { renderResumeHtml } from "../lib/render-resume-html";

export default async function ResumeXmlSSR() {
  let html =
    '<p class="text-sm text-rose-700">Could not render resume. Check XML/XSLT files in public/assets/docs.</p>';

  try {
    html = await renderResumeHtml();
  } catch (error) {
    console.error("Resume transform failed:", error);
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
