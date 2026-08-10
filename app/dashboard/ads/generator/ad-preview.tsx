"use client";

import React from "react";

interface AdPreviewProps {
  target: string;
  solution: string;
  riskReversal: string;
  dimension: "story" | "post";
  scale?: number;
}

/**
 * Parse solution text and return array of segments with highlight info
 * Text wrapped in {curly braces} will be highlighted in blue
 */
function parseSolution(text: string): { text: string; highlighted: boolean }[] {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return { text: part.slice(1, -1), highlighted: true };
      }
      return { text: part, highlighted: false };
    });
}

/**
 * Parse risk reversal text with highlight markers
 * Text wrapped in {curly braces} will be highlighted in blue with underline
 * Text on second line (after \n) will be displayed below
 */
function parseRiskReversal(text: string): { parts: { text: string; highlighted: boolean }[]; secondLine: string } {
  // Split on newline to get potential second line
  const lines = text.split("\n");
  const firstLine = lines[0];
  const secondLine = lines.slice(1).join("\n");

  // Parse first line for highlight markers
  const segments = firstLine.split(/(\{[^}]+\})/g);
  const parts = segments
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return { text: part.slice(1, -1), highlighted: true };
      }
      return { text: part, highlighted: false };
    });

  return { parts, secondLine };
}

export function AdPreview({
  target,
  solution,
  riskReversal,
  dimension,
  scale = 1,
}: AdPreviewProps) {
  const targetParts = parseSolution(target);
  const solutionParts = parseSolution(solution);
  const riskReversalParsed = parseRiskReversal(riskReversal);

  // Dimensions
  const width = 1080;
  const height = dimension === "story" ? 1920 : 1080;

  // Scale factors for text sizes based on dimension
  const isStory = dimension === "story";

  // Main Content Section
  const mainContent = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: isStory ? "80px 60px" : "40px 50px",
      }}
    >
      {/* Target Text (Blue with highlights) */}
      <div
        style={{
          fontSize: isStory ? 90 : 56,
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: isStory ? 35 : 20,
        }}
      >
        {targetParts.map((part, i) => (
          <span
            key={i}
            style={{
              color: part.highlighted ? "#0095F6" : "#000000",
            }}
          >
            {part.text}
          </span>
        ))}
      </div>

      {/* Solution Text */}
      <div
        style={{
          fontSize: isStory ? 90 : 56,
          fontWeight: 800,
          lineHeight: 1.1,
          color: "#000000",
        }}
      >
        {solutionParts.map((part, i) => (
          <span
            key={i}
            style={{
              color: part.highlighted ? "#0095F6" : "#000000",
            }}
          >
            {part.text}
          </span>
        ))}
      </div>
    </div>
  );

  // Trusted By Section
  const trustedBySection = (
    <div
      style={{
        backgroundColor: "#2D2D2D",
        padding: isStory ? "50px 60px" : "25px 50px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/trusted.webp"
        alt="Trusted by OpenAI and Chase"
        style={{
          width: isStory ? "80%" : "70%",
          height: "auto",
          objectFit: "contain",
        }}
      />
    </div>
  );

  // Risk Reversal Section
  const riskReversalSection = (
    <div
      style={{
        padding: isStory ? "60px" : "35px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isStory ? 25 : 16,
      }}
    >
      {/* Risk Reversal Text */}
      <div
        style={{
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        <span
          style={{
            fontSize: isStory ? 48 : 42,
            fontWeight: 600,
          }}
        >
          {riskReversalParsed.parts.map((part, i) => (
            <span
              key={i}
              style={{
                color: part.highlighted ? "#0095F6" : "#000000",
                textDecoration: part.highlighted ? "underline" : "none",
                textUnderlineOffset: "4px",
              }}
            >
              {part.text}
            </span>
          ))}
        </span>
        {riskReversalParsed.secondLine && (
          <>
            <br />
            <span
              style={{
                color: "#000000",
                fontSize: isStory ? 48 : 42,
                fontWeight: 700,
              }}
            >
              {riskReversalParsed.secondLine}
            </span>
          </>
        )}
      </div>

      {/* Progress Bar - Only for Story format */}
      {isStory && (
        <div
          style={{
            width: "80%",
            height: 8,
            backgroundColor: "#0095F6",
            borderRadius: 999,
            position: "relative",
          }}
        >
          {/* Start dot */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 20,
              height: 20,
              backgroundColor: "#0095F6",
              borderRadius: "50%",
            }}
          />
          {/* End dot */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translate(50%, -50%)",
              width: 20,
              height: 20,
              backgroundColor: "#0095F6",
              borderRadius: "50%",
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        width: width * scale,
        height: height * scale,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {mainContent}
        {/* Story: Trusted By -> Risk Reversal */}
        {/* Post: Risk Reversal -> Trusted By */}
        {isStory ? (
          <>
            {trustedBySection}
            {riskReversalSection}
          </>
        ) : (
          <>
            {riskReversalSection}
            {trustedBySection}
          </>
        )}
      </div>
    </div>
  );
}
