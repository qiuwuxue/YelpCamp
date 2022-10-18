const express = require('express')
const app = express()
const path = require('path')
const methodOverride = require('method-override')
const ejsMate = require('ejs-mate')
app.engine('ejs', ejsMate)
const session = require('express-session')
const flash = require('connect-flash')

const ExpressError = require('./utils/ExpressError')
const catchAsync = require('./utils/catchAsync')

const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost:27017/yelpcamp')
const db = mongoose.connection
db.on("error", console.error.bind(console, "connection error:"))
db.once("open", () => {
    console.log("Database connected")
})

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))   // setup the public folder to serve static assets

const Campground = require('./models/campground')
const Review = require('./models/review')

const {campgroundJOISchema, reviewJOISchema} = require('./utils/JOISchemas')
const validateCampground = (req,res,next)=>{
    const {error} = campgroundJOISchema.validate(req.body)
    if (error){
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    }else
        next()
}

const validateReview = (req, res, next)=>{
    const {error} = reviewJOISchema.validate(req.body)
    if (error){
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    }else
        next()    
}

const sessionConfig = {
    secret:'needbettersecret', resave: false, saveUninitialized: true,
    cookie:{httpOnly: true, expires: Date.now() + 1000 * 60 * 60 * 24 * 7, maxAge: 1000 * 60 * 60 * 24 * 7}
}
app.use(session(sessionConfig))
app.use(flash())

app.use((req,res,next)=>{
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next()
})

/////////////////////////////////////////////////////////////////

app.get('/', (req, res)=>{
    res.render('home.ejs')
})

app.get('/campgrounds', catchAsync(async (req, res, next)=>{
    const campgrounds = await Campground.find({})
    res.render('campgrounds/index.ejs', {campgrounds})
}))

// add new campground, form in new.ejs, submit post request to /campgrounds
app.get('/campgrounds/new', (req,res)=>{
    res.render('campgrounds/new.ejs')
})

app.post('/campgrounds', validateCampground, catchAsync(async (req, res, next)=>{
    const campground = new Campground(req.body.campground)
    await campground.save()
    req.flash('success', 'Successfully made a new campground!')
    res.redirect(`/campgrounds/${campground._id}`)
}))

app.get('/campgrounds/:id', catchAsync(async (req, res, next)=>{   
    const campground = await Campground.findById(req.params.id).populate('reviews')
    if (!campground){
        req.flash('error', 'Cannot find that campground!')
        res.redirect('/campgrounds')
    }else
        res.render('campgrounds/show.ejs', {campground})
}))

app.get('/campgrounds/:id/edit', catchAsync(async (req, res, next)=>{   
    const campground = await Campground.findById(req.params.id)
    res.render('campgrounds/edit.ejs', {campground})
}))

app.put('/campgrounds/:id', validateCampground, catchAsync(async (req, res, next)=>{   
    await Campground.findByIdAndUpdate(req.params.id, {...req.body.campground})
    req.flash('success', 'Successfully updated campground!')
    res.redirect(`/campgrounds/${req.params.id}`)
}))

app.delete('/campgrounds/:id', catchAsync(async (req, res, next)=>{   
    await Campground.findByIdAndDelete(req.params.id)
    req.flash('success', 'Successfully deleted campground!')
    res.redirect(`/campgrounds`)
}))

app.post('/campgrounds/:id/reviews', validateReview, catchAsync(async (req, res, next)=>{   
    const campground = await Campground.findById(req.params.id)
    const review = new Review(req.body.review)
    campground.reviews.push(review)
    await review.save()
    await campground.save()
    req.flash('success', 'Created new review!')
    res.redirect(`/campgrounds/${req.params.id}`)
}))

app.delete('/campgrounds/:id/reviews/:reviewID', catchAsync(async (req, res, next)=>{   
    await Campground.findByIdAndUpdate(req.params.id, {$pull: {reviews: req.params.reviewID}})
    await Review.findByIdAndDelete(req.params.reviewID)
    req.flash('success', 'Successfully deleted review!')
    res.redirect(`/campgrounds/${req.params.id}`)
}))



app.all('*', (req, res, next)=>{
    next(new ExpressError('Page Not Found', 404))
})

app.use((err,req,res,next)=>{
    const { statusCode = 500 } = err
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error.ejs', {err})
})

app.listen(3000, ()=>{
    console.log('listening on port 3000')
})