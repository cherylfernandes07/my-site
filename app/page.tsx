import Chat from "./components/chat";
import { renderResumeHtml } from "./lib/render-resume-html";

export default async function Home() {
  let resumeHtml =
    '<p class="text-sm text-rose-700">Could not render resume. Check XML/XSLT files in public/assets/docs.</p>';

  try {
    resumeHtml = await renderResumeHtml();
  } catch (error) {
    console.error("Resume transform failed:", error);
  }

  return (
    <main className="min-h-screen text-slate-900">
      <div className="flex flex-col lg:flex-row w-full min-h-screen">
        <div className="w-full lg:w-[70%] overflow-y-auto px-4 py-4 lg:px-6 lg:py-6 order-last lg:order-first">
          <div dangerouslySetInnerHTML={{ __html: resumeHtml }} />
        </div>
        <div className="w-full h-auto lg:h-screen lg:fixed lg:right-0 lg:top-0 lg:w-[30%] bg-slate-50 flex flex-col px-4 py-4 lg:px-5 lg:py-5 order-first lg:order-last">
          <Chat />
        </div>
      </div>
    </main>
  );
}
