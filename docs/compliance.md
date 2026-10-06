# Record checks and their sources

Checked 6 October 2026. Run `/compliance` or `node scripts/laundry.mjs compliance --json`.

These checks identify missing recorded evidence. They do not certify a laundry, determine liability or implement all NZ and Australian obligations. The owner must verify applicable law and the substances actually present. A link to an SDS does not prove workers can access it.

| Rule | What is checked | Basis and boundary |
|---|---|---|
| CARE-RECORD | An active garment has a care-label record and an intake-condition record | Internal operating control supporting reasonable care and skill. Neither source mandates these exact fields. |
| CLAIM-FOLLOWUP | An open claim has passed the follow-up date chosen by the operator | Internal control supporting timely remedies. The follow-up date is not a statutory deadline. |
| NZ-SDS | A recorded NZ hazardous substance has a safety data sheet reference | WorkSafe requires an SDS for hazardous substances subject to its rules, accessible to workers and emergency responders. Check exemptions and actual access. |
| NZ-INVENTORY | A recorded NZ substance has location, maximum quantity and hazard classification | WorkSafe inventory requirements. This is a subset of the full required inventory, not a completeness certificate. Include hazardous waste and any additional identifiers or storage details required for the site. |
| SDS-REVIEW | A recorded substance has a future or current internal review date | Operator-defined review reminder. It does not impose a statutory expiry period. |

## Sources

- [NZ Consumer Protection: Consumer Guarantees Act](https://www.consumerprotection.govt.nz/general-help/consumer-laws/consumer-guarantees-act). Services carry care, suitability and timing guarantees within the Act's scope.
- [NZ Consumer Protection: remedies for faulty services](https://www.consumerprotection.govt.nz/guidance-for-businesses/customer-returns-and-complaints/providing-remedies-for-faulty-services). Remedy depends on the failure. The software records the actual agreed response, never decides it.
- [ACCC: consumer rights and guarantees](https://www.accc.gov.au/business/selling-products-and-services/consumer-rights-and-guarantees). Due care and skill and other service guarantees apply within Australian Consumer Law. Consumer rules do not make every commercial linen contract identical.
- [WorkSafe: safety data sheets in the workplace](https://www.worksafe.govt.nz/dmsdocument/2632-safety-data-sheets-in-the-workplace-quick-guide/). Obtain supplier SDS information and make it accessible.
- [WorkSafe: hazardous substances inventory](https://www.worksafe.govt.nz/topic-and-industry/hazardous-substances/managing/inventory/). Record actual holdings and keep the inventory current.

No AU chemical compliance determination is implemented. NZ checks run only for NZ stores. AU records still receive the operator's review reminder. No rules here authorise uncollected-goods disposal, chemical handling, wastewater discharge or refunds. The seven-day rack threshold is a collection reminder only.

The demo uses deliberately incomplete and fictional chemical records. Replace them with verified supplier and site information before use. The inventory document retains those limitations in its note.
