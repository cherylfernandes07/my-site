import { XmlParser, Xslt } from "xslt-processor";
import fs from "fs";
import path from "path";

export async function renderResumeHtml() {
  const xmlString = fs.readFileSync(
    path.join(process.cwd(), "public/assets/docs/resume_template.xml"),
    "utf-8"
  );
  const xslString = fs.readFileSync(
    path.join(process.cwd(), "public/assets/docs/resume_template.xslt"),
    "utf-8"
  );

  const xmlParser = new XmlParser();
  const xml = await xmlParser.xmlParse(xmlString);

  const xslParser = new XmlParser();
  const xsl = await xslParser.xmlParse(xslString);

  const xsltEngine = new Xslt();
  return xsltEngine.xsltProcess(xml, xsl);
}