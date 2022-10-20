const Campground = require('./models/campground')
const Review = require('./models/review')
const ExpressError = require('./utils/ExpressError')
const {campgroundJOISchema, reviewJOISchema} = require('./utils/JOISchemas')

module.exports.isLoggedIn = (req,res,next)=>{
    if (!req.isAuthenticated()){
        req.session.returnTo = req.originalUrl
        req.flash('error', 'You must be signed in')
        res.redirect('/login')
    } else
        next()
}

module.exports.validateCampground = (req,res,next)=>{
    const {error} = campgroundJOISchema.validate(req.body)
    if (error){
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    }else
        next()
}

module.exports.validateReview = (req, res, next)=>{
    const {error} = reviewJOISchema.validate(req.body)
    if (error){
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    }else
        next()    
}

module.exports.isCampAuthor = async(req, res, next) =>{
    const campground = await Campground.findById(req.params.id)
    if (!campground.author.equals(req.user._id)){
        req.flash('error', 'You do not have permission to do that')
        res.redirect(`/campgrounds/${req.params.id}`)
    }else
        next()
}


module.exports.isReviewAuthor = async(req, res, next) =>{
    const {id, reviewID} = req.params
    const review = await Review.findById(reviewID)
    if (!review.author.equals(req.user._id)){
        req.flash('error', 'You do not have permission to do that')
        res.redirect(`/campgrounds/${req.params.id}`)
    }else
        next()
}