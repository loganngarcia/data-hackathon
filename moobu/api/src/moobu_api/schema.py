"""Field mappings from IRS 990 XML XPaths to Moobu schema."""

IRS_NS = "http://www.irs.gov/efile"
NS = {"irs": IRS_NS}

# Header fields (same for all form types)
HEADER_FIELDS: dict[str, str] = {
    "ein": "irs:ReturnHeader/irs:Filer/irs:EIN",
    "org_name": "irs:ReturnHeader/irs:Filer/irs:BusinessName/irs:BusinessNameLine1Txt",
    "tax_year": "irs:ReturnHeader/irs:TaxYr",
    "state": "irs:ReturnHeader/irs:Filer/irs:USAddress/irs:StateAbbreviationCd",
    "return_type": "irs:ReturnHeader/irs:ReturnTypeCd",
}

# Current Year (CY) financial fields from IRS990
CY_FIELDS: dict[str, str] = {
    "total_revenue": "irs:ReturnData/irs:IRS990/irs:CYTotalRevenueAmt",
    "total_expenses": "irs:ReturnData/irs:IRS990/irs:CYTotalExpensesAmt",
    "rev_less_expenses": "irs:ReturnData/irs:IRS990/irs:CYRevenuesLessExpensesAmt",
    "contributions_grants": "irs:ReturnData/irs:IRS990/irs:CYContributionsGrantsAmt",
    "program_service_rev": "irs:ReturnData/irs:IRS990/irs:CYProgramServiceRevenueAmt",
    "investment_income": "irs:ReturnData/irs:IRS990/irs:CYInvestmentIncomeAmt",
    "other_revenue": "irs:ReturnData/irs:IRS990/irs:CYOtherRevenueAmt",
}

# Prior Year (PY) financial fields from IRS990
PY_FIELDS: dict[str, str] = {
    "total_revenue": "irs:ReturnData/irs:IRS990/irs:PYTotalRevenueAmt",
    "total_expenses": "irs:ReturnData/irs:IRS990/irs:PYTotalExpensesAmt",
    "rev_less_expenses": "irs:ReturnData/irs:IRS990/irs:PYRevenuesLessExpensesAmt",
    "contributions_grants": "irs:ReturnData/irs:IRS990/irs:PYContributionsGrantsAmt",
    "program_service_rev": "irs:ReturnData/irs:IRS990/irs:PYProgramServiceRevenueAmt",
    "investment_income": "irs:ReturnData/irs:IRS990/irs:PYInvestmentIncomeAmt",
    "other_revenue": "irs:ReturnData/irs:IRS990/irs:PYOtherRevenueAmt",
}

# Balance sheet fields (not CY/PY split — single-year only)
BALANCE_FIELDS: dict[str, str] = {
    "net_assets_eoy": "irs:ReturnData/irs:IRS990/irs:NetAssetsOrFundBalancesEOYAmt",
    "net_assets_boy": "irs:ReturnData/irs:IRS990/irs:NetAssetsOrFundBalancesBOYAmt",
}

# Expense breakdown fields
EXPENSE_FIELDS: dict[str, str] = {
    "program_expenses": "irs:ReturnData/irs:IRS990/irs:TotalProgramServiceExpensesAmt",
    "total_func_expenses": "irs:ReturnData/irs:IRS990/irs:TotalFunctionalExpensesGrp/irs:TotalAmt",
}

# Profile/org enrichment fields
PROFILE_FIELDS: dict[str, str] = {
    "mission_description": "irs:ReturnData/irs:IRS990/irs:ActivityOrMissionDesc",
    "website": "irs:ReturnData/irs:IRS990/irs:WebsiteAddressTxt",
    "formation_year": "irs:ReturnData/irs:IRS990/irs:FormationYr",
    "employee_count": "irs:ReturnData/irs:IRS990/irs:TotalEmployeeCnt",
    "volunteer_count": "irs:ReturnData/irs:IRS990/irs:TotalVolunteersCnt",
}

# Officers/directors group XPath
OFFICERS_XPATH = "irs:ReturnData/irs:IRS990/irs:Form990PartVIISectionAGrp"

# All financial columns in the final filings table
FILING_COLUMNS = [
    "ein",
    "org_name",
    "tax_year",
    "state",
    "form_type",
    "filing_year",
    "total_revenue",
    "total_expenses",
    "rev_less_expenses",
    "contributions_grants",
    "program_service_rev",
    "investment_income",
    "other_revenue",
    "net_assets_eoy",
    "net_assets_boy",
    "program_expenses",
    "total_func_expenses",
    "source_file",
    "mission_description",
    "website",
    "formation_year",
    "employee_count",
    "volunteer_count",
]
