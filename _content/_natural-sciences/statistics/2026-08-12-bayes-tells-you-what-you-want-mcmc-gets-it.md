---
layout: post
title: "Bayes' Theorem Tells You What You Want. MCMC Gets It For You"
date: 2026-08-12
description: "Bayes' theorem and Markov chain Monte Carlo get mentioned in the same breath so often that they start to sound like competing methods. They are not the same kind of object at all."
abstract: >
  One is a line of algebra that says what the answer is. The other is a machine for reaching an answer you cannot write down. The confusion between them comes from a single term in the formula that almost nobody can compute.
math: true
---

These two turn up in the same paragraph constantly, which makes it easy to assume they are alternatives. Two approaches to the same problem, pick one.

They are not comparable that way. Bayes' theorem is a statement. MCMC is a procedure. Asking which to use is like asking whether you want the destination or the car.

The reason they get tangled is that one term in Bayes' theorem is usually impossible to calculate, and MCMC is the standard way of not calculating it.

## One Line of Algebra

Bayes' theorem falls out of the definition of conditional probability in about two steps:

$$P(\theta \mid D) = \frac{P(D \mid \theta)\,P(\theta)}{P(D)}$$

Read it right to left. You have a belief about some parameter before seeing data, $P(\theta)$. You have a model saying how likely the data would be under each value of that parameter, $P(D \mid \theta)$. Multiply, divide by a normalising term, and you get the belief you should hold after seeing the data.

That is the whole theorem. It is not a school of statistics or a philosophical position. It is true the way $a/b = c$ implies $a = bc$ is true, and a frequentist who denies every Bayesian premise still uses it to work out disease probabilities from test results.

Notice what it does not tell you. It says what the posterior *is*. It says nothing about how to compute it.

## The Denominator Is the Problem

$P(D)$ is the probability of the data, averaged over every possible value of the parameter. Written out:

$$P(D) = \int P(D \mid \theta)\,P(\theta)\,d\theta$$

For one parameter with a handful of possible values, you sum a few terms and move on. This is why the textbook examples always involve a medical test. Two hypotheses, sick or not sick, and the denominator is one addition.

Real models are not like that. A regression with thirty coefficients needs a thirty dimensional integral. A hierarchical model of student performance across schools can carry hundreds of parameters, and the integral runs over all of them at once.

You cannot brute force it. Chop each dimension into a modest grid of 100 points and thirty dimensions gives you $100^{30}$ cells to evaluate, a number with sixty digits. There is no computer, and there will not be one.

So the posterior exists. Bayes' theorem defines it exactly. And you still cannot write down its value at any point, because you cannot get the constant that scales it.

## Why the Ratio Doesn't Care

Here is the part I find genuinely elegant, and it is the hinge the whole subject turns on.

Suppose you stop asking for the posterior's value and ask a smaller question: given two parameter values, which one is more probable, and by what factor? Write the ratio:

$$\frac{P(\theta_1 \mid D)}{P(\theta_2 \mid D)}
= \frac{P(D \mid \theta_1)\,P(\theta_1) \big/ P(D)}{P(D \mid \theta_2)\,P(\theta_2) \big/ P(D)}
= \frac{P(D \mid \theta_1)\,P(\theta_1)}{P(D \mid \theta_2)\,P(\theta_2)}$$

$P(D)$ appears top and bottom. It cancels, which is the third expression above. The impossible integral drops out entirely, and what remains is the likelihood times the prior, both of which you can evaluate at any point you like in a fraction of a millisecond.

Metropolis-Hastings is built on that cancellation and very little else. Stand at some parameter value. Propose a step to a nearby one. Compute that ratio. If the new point is more probable, move there. If it is less probable, move there anyway with probability equal to the ratio, so a point half as likely gets accepted half the time. Repeat a few hundred thousand times.

That last rule is what makes it work rather than turning it into a hill climb. The chain is allowed to go downhill, which is how it explores the whole distribution instead of parking on the highest peak and reporting back that the peak is the answer.

Run it long enough and the fraction of time the chain spends in any region converges to the posterior probability of that region. You never computed $P(D)$. You never needed it. You have a pile of samples whose density *is* the shape you were after.

## MCMC Was Not Invented for This

Worth knowing, because it clarifies that the two ideas are independent.

Metropolis and colleagues published the algorithm in 1953 at Los Alamos, in a paper on equations of state for interacting molecules. It was a physics tool for computing thermodynamic averages, and Bayesian inference had nothing to do with it. Hastings generalised it in 1970. Only around 1990, when Gelfand and Smith connected it to Bayesian computation, did it become the thing that made applied Bayesian statistics practical.

The dependency runs one way and it is not symmetric. MCMC will sample from any distribution you can evaluate up to a constant, Bayesian or otherwise. And plenty of Bayesian problems never touch MCMC: pick a conjugate prior, a beta for a proportion, a normal for a mean with known variance, and the posterior comes out in closed form with the integral already solved. Those are the cases in the first three chapters of every textbook, which is part of why the split is easy to miss.

Bayes' theorem was published in 1763. It waited about two hundred and thirty years for a way to use it on problems of real size.

## What You Actually Get

Samples, not an answer. That distinction survives the whole process and it is where the practical trouble lives.

The chain gives you a few thousand parameter vectors drawn from the posterior. You want a mean, you average them. You want a 95% interval, you take the 2.5th and 97.5th percentiles. Anything you would have got by integrating, you get by summing over the draws instead, which works because that is what the sampling bought you.

The catch is that all of it depends on the chain having converged, and convergence is not something you can verify. You can run several chains from scattered starting points and check that they end up describing the same region. You can compute the R-hat statistic and want it under about 1.01. You can look at whether the draws are so correlated that ten thousand of them carry the information of two hundred.

Every one of those detects a chain that has clearly failed. None of them proves a chain has succeeded. A sampler can spend an hour in one mode of a bimodal posterior, never find the second, and produce diagnostics that look perfectly healthy, because from inside that mode nothing is wrong.

So the honest summary is that Bayes' theorem hands you an exact expression you cannot evaluate, and MCMC hands you an evaluation you cannot fully certify. The theorem is a fact. The sampler is an estimate that comes with a set of ways to catch it lying, and no way to confirm it is telling the truth.
