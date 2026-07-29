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
                "/reservebook",
                "/myreservations",
                "/cancelreservation",

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
                        "/setrole",
                        "/getreservations",
                        "/getlendedbooks",
                        "/getreturnedbooks",
                ];
