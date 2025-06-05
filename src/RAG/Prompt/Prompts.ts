import { PromptTemplate } from "@langchain/core/prompts";

const standAloneQuestionTemplate = `Givet samtalehistorik (hvis der er nogen) og et nyt
spørgsmål, omskriv spørgsmålet, så det fremstår som et
selvstændigt spørgsmål, der kan besvares ud fra
installationsbekendtgørelsen og elsikkerhedsloven.

Samtalehistorik:
{conv_history}

Spørgsmål:
{question}

Selvstændigt spørgsmål:`;

export const standaloneQuestionPrompt = PromptTemplate.fromTemplate(
  standAloneQuestionTemplate
);

export const answerTemplate = `Du er en hjælpsom og venlig support-bot med speciale i
installationsbekendtgørelsen og elsikkerhedsloven. Find altid svaret
i det givne kontekstmateriale – opdigt aldrig og tilføj ikke
information udefra. Referer gerne til relevante paragraffer eller
definitioner.

Kontekst:
{context}

Samtalehistorik:
{conv_history}

Spørgsmål:
{question}

Svar:`;

export const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);
