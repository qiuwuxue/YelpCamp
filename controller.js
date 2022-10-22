const Campground = require('./models/campground')
const Review = require('./models/review')
const User = require('./models/user')
const {cloudinary} = require('./cloudinary.js')
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding')
const mbxToken = process.env.MAPBOX_TOKEN
const geocoder = mbxGeocoding({accessToken: mbxToken})

///////////// campground ///////////////////////

module.exports.index = async (req, res, next)=>{
    const campgrounds = await Campground.find({})
    res.render('campgrounds/index.ejs', {campgrounds})
}

module.exports.showCampground = async (req, res, next)=>{   
    const campground = await Campground.findById(req.params.id).populate('author').populate({
        path: 'reviews', populate:{ path: 'author'}
    })
    if (!campground){
        req.flash('error', 'Cannot find that campground!')
        res.redirect('/campgrounds')
    }else
        res.render('campgrounds/show.ejs', {campground})
}


module.exports.createCampground = async (req, res, next)=>{
    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location, limit:1
    }).send()
    const campground = new Campground(req.body.campground)
    campground.geometry = geoData.body.features[0].geometry
    campground.images = req.files.map(f => ({url:f.path, filename:f.filename}))
    campground.author = req.user._id
    await campground.save()
    req.flash('success', 'Successfully made a new campground!')
    res.redirect(`/campgrounds/${campground._id}`)
}

module.exports.renderEditForm = async (req, res, next)=>{   
    const campground = await Campground.findById(req.params.id)
    res.render('campgrounds/edit.ejs', {campground})
}

module.exports.updateCampground = async (req, res, next)=>{   
    const campground = await Campground.findByIdAndUpdate(req.params.id, {...req.body.campground})
    campground.images.push(...req.files.map(f => ({url:f.path, filename:f.filename})))
    await campground.save()
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } })
    }
    req.flash('success', 'Successfully updated campground!')
    res.redirect(`/campgrounds/${req.params.id}`)
}

module.exports.deleteCampground = async (req, res, next)=>{ 
    const campground = await Campground.findById(req.params.id)
    if (campground.images){
        for (let img of campground.images){
            await cloudinary.uploader.destroy(img.filename)
        }
    } 
    await Campground.findByIdAndDelete(req.params.id)
    req.flash('success', 'Successfully deleted campground!')
    res.redirect(`/campgrounds`)
}


/////////////////// review //////////////////////////////

module.exports.createReview = async (req, res, next)=>{   
    const campground = await Campground.findById(req.params.id)
    const review = new Review(req.body.review)
    review.author = req.user._id
    campground.reviews.push(review)
    await review.save()
    await campground.save()
    req.flash('success', 'Created new review!')
    res.redirect(`/campgrounds/${req.params.id}`)
}

module.exports.deleteReview = async (req, res, next)=>{   
    await Campground.findByIdAndUpdate(req.params.id, {$pull: {reviews: req.params.reviewID}})
    await Review.findByIdAndDelete(req.params.reviewID)
    req.flash('success', 'Successfully deleted review!')
    res.redirect(`/campgrounds/${req.params.id}`)
}



////////////////// user //////////////////////////////
module.exports.register = async(req, res, next)=>{
    try{
        const {email, username, password} = req.body 
        const user = new User({email, username})
        const regUser = await User.register(user, password)
        req.login(regUser, (e)=>{
            if (e) return next(e)
            req.flash('success', 'Welcome to YelpCamp')
            res.redirect('/campgrounds')
        })
    } catch (e){
        req.flash('error', e.message)
        res.redirect('/register')
    }
}


module.exports.login = (req, res)=>{
    req.flash('success', 'Welcome back!')
    const preUrl = req.session.returnTo || '/campgrounds'
    delete req.session.returnTo
    res.redirect(preUrl)
}

module.exports.logout = (req,res,next)=>{
    req.logout(function(e){
        if (e) return next(e)
        req.flash('success', 'Successfully log out!')
        res.redirect('/campgrounds')
    })
}