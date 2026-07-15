export const routes = [
                "/getusers",
                "/deleteuser",
                "/postbook",
                //"/getallbooks",
                "/updatebook",
                "/deletebook",
                "/getbookbyquery",
                "/lendbook",
                "/getlendedbooks",
                "/lendedbooksbyuser",
                "/returnbook",
                "/getreturnedbooks",
                "/getbooksreturnedbyuser",

        ];

export const unauthorizedRoutes = [
                "/usersignin",
		"/healthcheck",
		"/getallbooks",
		"/checkroute",
        ];

export const adminRoutes = [
                        "/postnewbook",
                        "/updatebook",
                        "/deletebook",
                        "/getusers",
                        "/getlendedbooks",
                        "/getreturnedbooks",
                ];
