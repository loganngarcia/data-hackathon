# **Data** hackathon playbook

This README turns the kickoff into a checklist for scoring and delivery. Every fact below came from the live kickoff transcript.

## **What** winning means here

Judges said the product must be accurate and easy for a stakeholder to use, not only technically correct. Communicate insights clearly. If you use AI to write code, know what it did.

Round one asks for your slide deck, a video, and your code to all judges. That round is where you show scope of analysis, how strong the tool is, and that you understand your own build.

## **How** scores break down

40% ties to financial insight and model depth: practical business value, peer benchmarking, and whether groupings or clusters make sense for the people you compare.

60% ties to solution development, data analysis, and business storytelling. Storytelling is mainly the presentation.

## **Problem** you are solving

You have about seven years of nonprofit tax return data in structured XML. From that, the program wants signal on who is thriving, who is financially resilient, and who is at risk of not keeping the lights on if a large grant disappears. Find where an organization tips from successful to unsuccessful. Consider where a donor gets leverage, for example a large national charity that keeps doing its work versus a smaller charity that might expand materiality with new funds. Track how you judge success versus failure across years.

Three dimensions named in the brief are resilience prediction, peer benchmarking, and funding risk simulations such as a large shock. Look for characteristics in tax lines and spending that separate meaningful peer groups.

Fair Island Advisors works with nonprofits. Maya from the sponsor team said nonprofits are tax exempt, common form is 501(c), and filings are public. She noted that if the nonprofit sector were an industry it would rank third in the United States by size after retail and manufacturing, with about 1.4 trillion dollars in economic activity in 2023, about thirteen million employees, and on the order of two million organizations. She stated that about four percent of organizations generate about eighty percent of revenue, with healthcare and education, including private universities named as examples, as two large slices, while legal aid, environmental protection, child safety, animal welfare, and immigration were listed as examples of other mission areas. She wants to see which organizations could plausibly build invested reserves instead of spending every inflow, and said ninety six percent do not currently have enough cushion to do that comfortably. Geography may matter state to state or county to county. A single Form 990 from one year alone is not enough for her firm to decide whether to pursue a relationship.

## **Who** judges you

Confirmed from the kickoff: Maya from Fair Island Advisors, Professor Prasad from the MSBA program, Joe as a UC Davis alum who won this hackathon in prior years, and Eric as executive director of the program. A Fairlight Advisors representative joins for the final judging round only. Deb was thanked as a sponsor alongside Maya.

## **Behaviors** that convert to points

Understand the question before you touch the data so you do not burn hours moving wrong.

Budget real time for cleaning. Form 990 data is called out as inconsistent with many missing fields. Ship a basic model, then improve.

Prefer simple methods first, then test simpler alternatives until you find insight that holds across approaches. Professor Prasad recommended comparing a complex model to something like gradient boosting and then to linear models to see what is robust.

Tell a story the sponsor can act on. Start from what a nonprofit leader already knows, extract information, then recommendations framed as if I do this, then this happens. Think as both an investor in a nonprofit and an executive running one, not only as a data scientist.

Document assumptions and model choices in comments or short writeups so judges can follow your reasoning on an open ended problem with no single correct answer.

Define the metrics you use and state them explicitly. That was called out as especially helpful.

Run as a team. Split work for cohesion, keep the problem statement first when opinions clash, and have one person own deadlines and deliverable rules so you do not miss cutoffs.

Manage time with phases and buffers. Joe recommended deciding in advance when the model must be frozen so you can move to insight and slides.

Do not quit because other teams feel the same pressure. Eric said some winners almost did not advance past the first round.

## **Deliverables** and timing called out in the kickoff

Video length for the submission is five minutes. There is no hard slide cap, but organizers asked for roughly fifteen slides or fewer if you can. Full spec goes out separately.

Office hours were announced as six to eight pm on kickoff day and three to eight pm the following day. Jacob and Niti run the hackathon and hold hours.

You may publish your work after the event. Organizers said what you build is yours, the data is public, and they hope you post to GitHub and LinkedIn. Eric offered to connect interested students with marketing for blogs and noted a photographer named Tim may be present at the award event.

## **Prizes** and ceremony

Gold, silver, and bronze team prizes were announced. Eric named two thousand dollars per team for the silver award in the kickoff audio. Extra awards include best team, best storytelling, and best presenter.

Awards are presented at Spark Social on April twenty first. Attendance was encouraged even if you do not advance, to support classmates.

## **Repository** hygiene for this workspace

Do not commit API tokens or team secrets. Use environment variables or local untracked files.

Cursor agent skills live under `.agents/skills/`. See `AGENTS.md` for agent notes.
