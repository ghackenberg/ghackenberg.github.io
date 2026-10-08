/**
 * Technology Readiness Level (TRL) Definitions
 * Standardized 9-level framework aligned with NASA and EU Horizon Europe standards.
 */

export interface TrlDefinition {
  level: number;
  title: string;
  shortDesc: string;
  fullDesc: string;
}

export const TRL_DEFINITIONS: Record<number, TrlDefinition> = {
  1: {
    level: 1,
    title: 'Basic Principles Observed',
    shortDesc: 'Basic principles observed and reported.',
    fullDesc: 'Scientific research begins to be translated into applied research and development. Basic physical or computational principles are observed, reported, and initial speculative properties or application concepts are formulated.'
  },
  2: {
    level: 2,
    title: 'Technology Concept Formulated',
    shortDesc: 'Technology concept and/or application formulated.',
    fullDesc: 'Practical applications are identified and outlined. Basic principles are applied to specific needs, but proofs of concept or experimental validations remain theoretical and unvalidated.'
  },
  3: {
    level: 3,
    title: 'Experimental Proof of Concept',
    shortDesc: 'Analytical and experimental critical function and/or characteristic proof of concept.',
    fullDesc: 'Active research and development are initiated. Analytical modeling and laboratory-scale experimental studies validate analytical predictions and prove the technical viability of core concept components.'
  },
  4: {
    level: 4,
    title: 'Technology Validated in Lab',
    shortDesc: 'Component and/or breadboard validation in laboratory environment.',
    fullDesc: 'Key components and software architecture modules are integrated and tested together in a controlled laboratory environment, establishing that disparate elements work together to achieve baseline performance.'
  },
  5: {
    level: 5,
    title: 'Technology Validated in Relevant Environment',
    shortDesc: 'Component and/or breadboard validation in relevant environment.',
    fullDesc: 'The technology is integrated with realistic supporting elements and simulated interfaces, tested under high-fidelity conditions that simulate the anticipated operational environment.'
  },
  6: {
    level: 6,
    title: 'Technology Demonstrated in Relevant Environment',
    shortDesc: 'System/subsystem model or prototype demonstration in a relevant environment.',
    fullDesc: 'A fully functional representative engineering prototype or pilot architecture is demonstrated in an operational or high-fidelity relevant environment, demonstrating critical functions across realistic constraints.'
  },
  7: {
    level: 7,
    title: 'System Prototype Demonstration in Operational Environment',
    shortDesc: 'System prototype demonstration in an operational environment.',
    fullDesc: 'The prototype is deployed and evaluated in the actual operational environment under real-world conditions, demonstrating end-to-end system performance and addressing operational hurdles.'
  },
  8: {
    level: 8,
    title: 'System Complete and Qualified',
    shortDesc: 'Actual system completed and qualified through test and demonstration.',
    fullDesc: 'The complete hardware/software system is thoroughly tested, certified, and qualified under operational conditions, with full documentation, quality assurance, and compliance with domain standards.'
  },
  9: {
    level: 9,
    title: 'Actual System Proven in Operational Environment',
    shortDesc: 'Actual system proven in operational environment through successful mission operations.',
    fullDesc: 'The technology is fully mature, battle-tested, and actively running in live mission or commercial production environments, demonstrating sustained reliability, scalability, and operational excellence over time.'
  }
};

/**
 * Retrieves the TRL definition for a given maturity level (clamped to 1-9).
 * @param level Technology readiness level number (1-9)
 */
export function getTrlDefinition(level: number): TrlDefinition {
  const normalizedLevel = Math.max(1, Math.min(9, Math.round(level)));
  return TRL_DEFINITIONS[normalizedLevel] ?? TRL_DEFINITIONS[1];
}
