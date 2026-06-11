const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const { NationalityEnum } = require("../../../utils/constants/ENUM");

const getCountries = catchAsyncError(async (req, res) => {
    let { search = "", page = 1, limit = 20 } = req.query;

    // Validate page and limit
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 20;

    // Convert enum object to array
    const countries = Object.values(NationalityEnum);
    console.log(countries);

    // Filter by search query (case-insensitive)
    const filteredCountries = search
        ? countries.filter((country) =>
            country.toLowerCase().includes(search.toLowerCase())
        )
        : countries;

    if (!filteredCountries.length) {
        throw new ApiError(statusCode.NOT_FOUND, "No countries found");
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedCountries = filteredCountries.slice(startIndex, endIndex);

    return res.status(statusCode.OK).json(
        new ApiResponse(
            statusCode.OK, // statusCode
            {
                page,
                limit,
                total: filteredCountries.length,
                totalPages: Math.ceil(filteredCountries.length / limit),
                data: paginatedCountries,
            },
            "Countries fetched successfully" // message
        )
    );

   
        
    
});

module.exports = 
{
    getCountries,
};
