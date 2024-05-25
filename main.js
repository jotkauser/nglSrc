$(document).ready(function () {
    // Shared Vars
    let paymentAvailable = false
    let userData = JSON.parse(window.localStorage.getItem('userData'))
     // Available in user page
     // userData contains region in sent page
    const userRegion = $("#userRegion").val()
    
    // Mixpanel init
    mixpanel.init("e8e1a30fe6d7dacfa1353b45d6093a00")
    if (userData?.region === "US" || userRegion === "US") {
        mixpanel.track_links(".rizz-button", "web_sent_tapped_new_app")
        // Link visiter events
        mixpanel.track_links(".download-link1", "web_tapped_get_your_own", {
            text: $(".download-link1").text(),
            ab_web_download_button_test_version: 3
        })
        mixpanel.track_links(".download-link2", "web_sent_tapped_get_your_own", {
            text: $(".download-link2").text(),
            ab_web_download_button_test_version: 3
        })
        // App user events
        if (uid) {
            mixpanel.track_links(".download-link1", "web_received_download", {
                distinct_id: uid,
                page: "user",
                text: $(".download-link1").text(),
                ab_web_download_button_test_version: 3
            })
            mixpanel.track_links(".download-link2", "web_received_download", {
                distinct_id: uid,
                page: "sent",
                text: $(".download-link2").text(),
                ab_web_download_button_test_version: 3
            })
        }
        mixpanel.track_links(".another1", "web_sent_tapped_send_another_message")
    }

    $('.download-link').click(() => {
        $.ajax({
            url: '/api/pixel',
            type: 'POST',
            data: {
                deviceId: window.localStorage.getItem('deviceId')
            }
        }).done(function (data) {
            console.log('Pixel Response', data)
        }).fail(function (err) {
            console.log('Pixel Failed')
        })
    })

    // Stripe init
    const stripe = Stripe('find it yourself', { apiVersion: "2020-08-27" });
    // const stripe = Stripe('find it yourself', { apiVersion: "2020-08-27" });

    const paymentRequest = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
            label: 'Boost Message',
            amount: 99,
        },
        requestPayerName: true,
        requestPayerEmail: true,
    });

    // Payment request
    paymentRequest.canMakePayment().then(result => {
        // mixpanel.track("payment_available_new", {
        //     paymentAvailable: result?.applePay ? 'applePay' : result?.googlePay ? 'googlePay' : result?.link ? 'link' : null
        // })
        if (result?.applePay) {
            console.log('ApplePay Enabled')
            paymentAvailable = 'applePay'
        } else if (result?.googlePay) {
            console.log('GooglePay Enabled')
            paymentAvailable = 'googlePay'
        } else if (result?.link) {
            console.log('Link Enabled')
            paymentAvailable = 'link'
        } else {
            console.log('no payment available')
        }
    })

    // Listen for Payment
    paymentRequest.on('paymentmethod', async (ev) => {
        // Send request to /api/getPaymentIntent using jQuery ajax
        const data = await $.ajax({
            url: '/api/getPaymentIntent',
            method: 'POST',
            data: { questionId: userData.questionId }
        });

        // Confirm the PaymentIntent without handling potential next actions (yet).
        const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
            data.clientSecret,
            { payment_method: ev.paymentMethod.id },
            { handleActions: false }
        );

        if (confirmError) {
            if (userData?.region === "US") {
                mixpanel.track("priority_inbox_payment_failed")
            }
            ev.complete('fail')
            return alert("Your payment method failed. Try again or skip.")
        }

        if (paymentIntent.status === "requires_action") {
            const { error } = await stripe.confirmCardPayment(data.clientSecret);
            if (error) return alert("Your payment method failed. Try again or skip.")
        }

        ev.complete('success')
        if (userData?.region === "US") {
            mixpanel.track("priority_inbox_payment_succeeded")
        }

        $('.modal-container').addClass('off')
        setTimeout(() => {
            $('.modal-container').hide()
        }, 300)

        userData.isBoosted = true
        window.localStorage.setItem('userData', JSON.stringify(userData))
        isBoostedUI()
    });

    function isBoostedUI() {
        $('.boost').addClass('button-translucent')
        $('.boost').removeClass('button-white')
        $('.boost').removeClass('pulse')
        $('.boost').text(window.translations.boosted)
        $('.boost').off("click")
    }

    // /p/sent logic
    if (window.location.pathname.includes('p/sent')) {
        // UI
        $('.modal-container').hide()
        $('.pfp').attr('src', userData?.ig_pfp_url)
        if (userData?.isBoosted && false) isBoostedUI()
        if (userData?.priorityInboxEnabled && userData?.paymentAvailable && false) {
            $('.boost').show()
            $('.boost').addClass('pulse')
            // mixpanel.track("web_sent_seen_boosted_button")
        } else {
            $('.boost').hide()
            $('.download-link').addClass('pulse')
        }

        // Handlers
        $('.boost').click(() => {
            if (userData?.region === "US") {
                mixpanel.track("web_sent_tapped_boosted_button")
            }
            $('.modal-container').show()
            $('.modal-container').removeClass('off')
        })
        $('.modal-bg, .priority-x').click(() => {
            if (userData?.region === "US") {
                mixpanel.track("web_sent_boosted_menu_tapped_hide")
            }
            // mixpanel.track("priority_inbox_skipped")
            $('.modal-container').addClass('off')
            setTimeout(() => {
                $('.modal-container').hide()
            }, 300)
        })
        $('.pay').click(async () => {
            if (paymentAvailable) {
                // let r = await $.ajax({
                //     url: '/api/stripe-checkout',
                //     type: 'POST'
                // })
                // window.location.href = r.url
                if (userData?.region === "US") {
                    mixpanel.track("web_sent_boosted_menu_tapped_pay")
                    mixpanel.track("priority_inbox_payment_clicked")
                }
                paymentRequest.show()
            } else {
                if (userData?.region === "US") {
                    mixpanel.track("web_sent_boosted_menu_tapped_pay_failed")
                }
                alert('Please try again in a few seconds.')
            }
        })

    } else {
        // /username/game logic
        window.localStorage.removeItem('userData')
    }
    // Asking question form
    $('.form').submit(function (e) {
        e.preventDefault();

        if ($('#question').val().trim() === '') {
            return alert('Please enter a question first!')
        }

        $('.submit').attr('disabled', true)
        const userRegion = $("#userRegion").val()
        if (userRegion === "US") {
            mixpanel.track("web_tapped_send")
        }

        let referrer = document.referrer
        if (navigator.userAgent.includes("Snapchat")) referrer = "https://snapchat.com"

        let data = {
            username: username,
            question: $('#question').val(),
            deviceId: $('.deviceId').val(),
            gameSlug: gameSlug,
            referrer: referrer
        }

        $.ajax({
            url: '/api/submit',
            type: 'POST',
            data
        }).done(function (data) {
            console.log('Sent Question', data)
            window.localStorage.setItem('userData', JSON.stringify({
                questionId: data.questionId,
                priorityInboxEnabled,
                paymentAvailable,
                ig_pfp_url,
                ig_username,
                region: data.userRegion,
            }))

            const userLanguage = $("meta[name='user:language']").attr("content")
            let url = '/p/sent'
            if (gameSlug) url += `/${gameSlug}`
            if (userLanguage) url += `?lng=${userLanguage}`
            if (uid) url += `&u=${uid}`
            
            // Part of the AB test for reengagement messages
            // To be deleted later
            const downloadCopy = $(".download-link1").text()
            if (userLanguage === "en" && userRegion === "US") {
                url += `&ab_download_button=${encodeURIComponent(downloadCopy)}`
            }
            window.location.href = url
        }).fail(function (err) {
            console.log('submitted - failed')
            console.log('Error submitting question', err);
            alert('Internet error! Try again')
        })
    })

    window.addEventListener("pageshow", function (event) {
        var historyTraversal = event.persisted ||
            (typeof window.performance != "undefined" &&
                window.performance.navigation.type === 2);
        if (historyTraversal) {
            // Handle page restore.
            $('.submit').attr('disabled', false)
            $('textarea').val('')
            $('.bottom-container').show()
            $('.priority-modal').hide()
            if (!(/android/i.test(userAgent))) {
                $('.submit').hide()
            }
        }
    });

    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    const referrer = document.referrer

    if (/android/i.test(userAgent)) {
        // NGL Download Link
        $('.download-link').attr('href', 'https://play.google.com/store/apps/details?id=com.nglreactnative')

        // Rizz Download link
        $('.rizz-button').attr('href', 'https://play.google.com/store/apps/details?id=com.rizz.android')
    }

    // If Snap preview, hide download button
    // What makes something Snap preview? 
    // All must be true:
        // referrer does not include Snapchat
        // userAgent does not include Instagram
        // userAgent contains iPhone
        // userAgent does not contain Safari
        // userAgent does not contain FBAN (Facebook)
    // if (
    //     !referrer.toLowerCase().includes('snapchat') &&
    //     !userAgent.toLowerCase().includes('instagram') &&
    //     userAgent.toLowerCase().includes('iphone') &&
    //     !userAgent.toLowerCase().includes('safari') &&
    //     !userAgent.toLowerCase().includes('fban')
    // ) {
    //     $('.bottom-container-user-wrapper').hide();
    // }

    $('textarea').focus(function () {
        $('.bottom-container').hide()
    })

    $('textarea').blur(function () {
        $('.bottom-container').show()
    })

    $('textarea').on('input', function (e) {
        if (e.target.value == '' && !(/android/i.test(userAgent))) {
            $('.submit').hide()
        } else {
            $('.submit').show()
        }
    });

    if (!(/android/i.test(userAgent))) {
        $('.submit').hide()
    }

    // DICE QUESTIONS
    const APP_CDN_BASE_URL = "https://cdn.simplelocalize.io/57157aec81d54cb6b2a43f8b34a61d47/_production/";
    const userLanguage = $("meta[name='user:language']").attr("content") || 'en';
    let randomQuestions = []

    $.get(APP_CDN_BASE_URL + userLanguage, function (data) {
        const fakeQuestionKeys = Object.keys(data).filter(key => key.startsWith('FAKE_QUESTIONS.'))
        randomQuestions = fakeQuestionKeys.map(key => data[key])

    });


    $('.dice-button').click(function (e) {
        // Set textrea text to a random question
        console.log(randomQuestions)
        const randomQuestion = randomQuestions[Math.floor(Math.random() * randomQuestions.length)];
        $('textarea').val(randomQuestion + ' ')
        $('textarea').focus()
        $('textarea')[0].selectionStart = randomQuestion.length + 1
        $('textarea')[0].selectionEnd = randomQuestion.length + 1

        $('.submit').show()

        e.preventDefault()
    })

    if (!window.localStorage.getItem('deviceId')) {
        function uuidv4() {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        }
        window.localStorage.setItem('deviceId', uuidv4())
    }

    $('.deviceId').val(window.localStorage.getItem('deviceId'))

    setInterval(() => {
        let clickCount = parseInt($('.clickCount').text())
        clickCount += Math.floor(Math.random() * 5) - 1
        $('.clickCount').text(clickCount)
    }, 800)

    // Pageview
    if (!window.location.pathname.includes('p/sent')) {
        if (userRegion === "US") {
            mixpanel.track("web_received_pageview", { "distinct_id": uid, referrer: window.document.referrer })
            mixpanel.track("web_viewed_page", { ab_web_download_button: $(".download-link1").text(), ab_web_download_button_test_version: 2 })
        }

        $.ajax({
            url: '/api/pageview',
            type: 'POST',
            data: {
                uid: uid,
                referrer: window.document.referrer,
                game: gameId,
                deviceId: window.localStorage.getItem('deviceId')
            }
        }).done(function (data) {
            console.log(data)
        })

        $.ajax({
            url: '/api/fingerprint/web',
            type: 'POST',
            data: {
                deviceId: window.localStorage.getItem('deviceId')
            }
        }).done(function (data) {
            console.log('Fingerprint Web', data)
        })
    }

    // Show Rizz button if user agent contains "Snapchat"
    if (navigator.userAgent.includes("Snapchat")) {
        // Set .rizz-button to display: flex
        $('.rizz-button').css('display', 'flex')
    }
});