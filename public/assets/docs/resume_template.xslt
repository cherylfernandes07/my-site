<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:html="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="html">
  <xsl:output method="html" indent="yes" omit-xml-declaration="yes"/>

  <xsl:template match="/resume">
    <div class="resume-root">
      <style>
        .resume-root {
          color: #111827;
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          line-height: 1.2;
          font-size: 10pt;
        }

        .resume-root * { box-sizing: border-box; }

        .resume-root .page {
          width: min(100%, 8.5in);
          margin: 0 auto;
          padding: 0.5in;
          background: #ffffff;
          border: 1px solid #d1d5db;
        }

        .resume-root .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }

        .resume-root .name {
          margin: 0;
          font-size: 18pt;
          line-height: 1;
          letter-spacing: 0.2px;
        }

        .resume-root .role {
          margin: 1px 0 4px;
          font-size: 10.5pt;
          color: #4b5563;
          font-weight: 600;
        }

        .resume-root .contact {
          display: flex;
          flex-wrap: wrap;
          gap: 3px 8px;
          color: #4b5563;
          font-size: 9.5pt;
        }

        .resume-root .contact span { white-space: nowrap; }
        .resume-root .contact a { text-decoration: underline; }

        .resume-root section { margin-bottom: 6px; }

        .resume-root .section-title {
          margin: 0 0 4px;
          text-transform: uppercase;
          font-size: 9pt;
          letter-spacing: 0.6px;
          color: #0f172a;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 2px;
        }

        .resume-root p { margin: 4px 0; }
        .resume-root .skills-group { margin-bottom: 2px; }
        .resume-root .skills-group strong { font-size: 9.5pt; }
        .resume-root .job,
        .resume-root .degree,
        .resume-root .cert,
        .resume-root .project {
          margin-bottom: 6px;
        }

        .resume-root .row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
        }

        .resume-root .left { min-width: 0; }

        .resume-root .company,
        .resume-root .school,
        .resume-root .cert-name,
        .resume-root .project-name {
          font-weight: 700;
          font-size: 10pt;
        }

        .resume-root .job-title,
        .resume-root .credential,
        .resume-root .issuer {
          color: #4b5563;
          font-size: 9.5pt;
          margin-top: 1px;
        }

        .resume-root .right {
          text-align: right;
          color: #4b5563;
          font-size: 10pt;
          white-space: nowrap;
        }

        .resume-root .subtle {
          margin-top: 2px;
          color: #4b5563;
          font-size: 9pt;
        }

        .resume-root ul {
          margin: 2px 0 0 14px;
          padding: 0;
        }

        .resume-root li { margin-bottom: 0; }
        .resume-root a { color: inherit; text-decoration: none; }

        .resume-root .project-link {
          margin-top: 3px;
          color: #4b5563;
          font-size: 10pt;
          word-break: break-word;
        }
      </style>

      <main class="page">
        <header class="header">
          <h1 class="name"><xsl:value-of select="personal/name"/></h1>
          <p class="role"><xsl:value-of select="personal/title"/></p>
          <div class="contact">
            <xsl:if test="normalize-space(personal/email)"><span><xsl:value-of select="personal/email"/></span></xsl:if>
            <xsl:if test="normalize-space(personal/phone)"><span><xsl:value-of select="personal/phone"/></span></xsl:if>
            <xsl:if test="normalize-space(personal/location)"><span><xsl:value-of select="personal/location"/></span></xsl:if>
            <xsl:if test="normalize-space(personal/linkedin)"><span><a href="{personal/linkedin}">LinkedIn</a></span></xsl:if>
            <xsl:if test="normalize-space(personal/website)"><span><a href="{personal/website}">Website</a></span></xsl:if>
            <xsl:if test="normalize-space(personal/portfolio)"><span><a href="{personal/portfolio}">GitHub</a></span></xsl:if>
          </div>
        </header>

        <xsl:if test="normalize-space(summary)">
          <section>
            <h2 class="section-title">Summary</h2>
            <p><xsl:value-of select="summary"/></p>
          </section>
        </xsl:if>

        <xsl:if test="count(skills/category) &gt; 0">
          <section>
            <h2 class="section-title">Skills</h2>
            <xsl:for-each select="skills/category">
              <div class="skills-group">
                <strong><xsl:value-of select="@name"/>:</strong>
                <xsl:text> </xsl:text>
                <xsl:for-each select="skill[normalize-space(.) != '']">
                  <xsl:value-of select="."/>
                  <xsl:if test="position() != last()"><xsl:text>, </xsl:text></xsl:if>
                </xsl:for-each>
              </div>
            </xsl:for-each>
          </section>
        </xsl:if>

        <xsl:if test="count(experience/job) &gt; 0">
          <section>
            <h2 class="section-title">Experience</h2>
            <xsl:for-each select="experience/job">
              <article class="job">
                <div class="row">
                  <div class="left">
                    <div class="company"><xsl:value-of select="title"/></div>
                    <div class="job-title">
                      <xsl:value-of select="company"/>
                      <xsl:if test="normalize-space(location)"><xsl:text>, </xsl:text><xsl:value-of select="location"/></xsl:if>
                    </div>
                  </div>
                  <div class="right">
                    <xsl:value-of select="start"/>
                    <xsl:if test="normalize-space(end)"><xsl:text> - </xsl:text><xsl:value-of select="end"/></xsl:if>
                  </div>
                </div>
                <xsl:if test="normalize-space(description)">
                  <div class="subtle"><xsl:value-of select="description"/></div>
                </xsl:if>
                <xsl:if test="count(bullets/bullet[normalize-space(.) != '']) &gt; 0">
                  <ul>
                    <xsl:for-each select="bullets/bullet[normalize-space(.) != '']">
                      <li><xsl:value-of select="."/></li>
                    </xsl:for-each>
                  </ul>
                </xsl:if>
              </article>
            </xsl:for-each>
          </section>
        </xsl:if>

        <xsl:if test="count(education/degree) &gt; 0">
          <section>
            <h2 class="section-title">Education</h2>
            <xsl:for-each select="education/degree">
              <article class="degree">
                <div class="school">
                  <xsl:value-of select="credential"/>
                  <xsl:if test="normalize-space(school)"><xsl:text>, </xsl:text><span class="credential"><xsl:value-of select="school"/></span></xsl:if>
                </div>
              </article>
            </xsl:for-each>
          </section>
        </xsl:if>

        <xsl:if test="count(certifications/cert) &gt; 0">
          <section>
            <h2 class="section-title">Certifications</h2>
            <xsl:for-each select="certifications/cert[normalize-space(name) != '' and not(normalize-space(grade) = 'In Progress')]">
              <article class="cert">
                <div class="row">
                  <div class="left">
                    <div class="cert-name">
                      <xsl:value-of select="name"/>
                      <xsl:if test="normalize-space(issuer)"><xsl:text>, </xsl:text><span class="issuer"><xsl:value-of select="issuer"/></span></xsl:if>
                    </div>
                  </div>
                  <div class="right"><xsl:value-of select="grade"/></div>
                </div>
              </article>
            </xsl:for-each>
          </section>
        </xsl:if>

        <xsl:if test="count(projects/project) &gt; 0">
          <section>
            <h2 class="section-title">Projects</h2>
            <xsl:for-each select="projects/project">
              <article class="project">
                <div class="project-name"><xsl:value-of select="name"/></div>
                <p><xsl:value-of select="description"/></p>
                <xsl:if test="normalize-space(link)">
                  <p class="project-link"><a href="{link}"><xsl:value-of select="link"/></a></p>
                </xsl:if>
              </article>
            </xsl:for-each>
          </section>
        </xsl:if>

        <xsl:if test="count(academic/area[normalize-space(.) != '']) &gt; 0">
          <section>
            <h2 class="section-title">Academic Work</h2>
            <div class="skills-group">
              <xsl:for-each select="academic/area[normalize-space(.) != '']">
                <xsl:value-of select="."/>
                <xsl:if test="position() != last()"><xsl:text>, </xsl:text></xsl:if>
              </xsl:for-each>
            </div>
          </section>
        </xsl:if>

        <xsl:if test="count(other/category) &gt; 0">
          <section>
            <h2 class="section-title">Other Experience</h2>
            <xsl:for-each select="other/category">
              <div class="category">
                <strong><xsl:value-of select="@name"/>:</strong>
                <xsl:if test="count(item[normalize-space(.) != '']) &gt; 0">
                  <ul>
                    <xsl:for-each select="item[normalize-space(.) != '']">
                      <li><xsl:value-of select="."/></li>
                    </xsl:for-each>
                  </ul>
                </xsl:if>
              </div>
            </xsl:for-each>
          </section>
        </xsl:if>
      </main>
    </div>
  </xsl:template>
</xsl:stylesheet>
