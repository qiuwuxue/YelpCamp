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


const passport = require('passport')
const passportLocal = require('passport-local')
const User = require('./models/user')
app.use(passport.initialize())
app.use(passport.session())  // passport.session() must be after app.use(session())
passport.use(new passportLocal(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

const isLoggedIn = (req,res,next)=>{
    if (!req.isAuthenticated()){
        req.session.returnTo = req.originalUrl
        console.log(req.session)
        req.flash('error', 'You must be signed in')
        res.redirect('/login')
    } else
        next()
}

app.use((req,res,next)=>{
    res.locals.currentUser = req.user
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next()
})

/////////////////////////////////////////////////////////////////

app.get('/', (req, res)=>{
    res.render('home.ejs')
})

app.get('/register', (req, res)=>{
    res.render('users/register.ejs')
})

app.post('/register', catchAsync(async(req, res, next)=>{
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
}))

app.get('/login', (req, res)=>{
    res.render('users/login.ejs')
})

app.post('/login', passport.authenticate('local', {failureFlash:true, failureRedirect:'/login', keepSessionInfo:true}), (req, res)=>{
    req.flash('success', 'Welcome back!')
    const preUrl = req.session.returnTo || '/campgrounds'
    delete req.session.returnTo
    res.redirect(preUrl)
})

app.get('/logout', (req,res,next)=>{
    req.logout(function(e){
        if (e) return next(e)
        req.flash('success', 'Successfully log out!')
        res.redirect('/campgrounds')
    })
})


app.get('/campgrounds', catchAsync(async (req, res, next)=>{
    const campgrounds = await Campground.find({})
    res.render('campgrounds/index.ejs', {campgrounds})
}))

// add new campground, form in new.ejs, submit post request to /campgrounds
app.get('/campgrounds/new', isLoggedIn, (req,res)=>{
    res.render('campgrounds/new.ejs')
})

app.post('/campgrounds', isLoggedIn, validateCampground, catchAsync(async (req, res, next)=>{
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